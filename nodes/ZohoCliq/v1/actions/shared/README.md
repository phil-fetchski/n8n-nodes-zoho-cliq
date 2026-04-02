# ZohoCliq Shared Actions - Development Map (Local Only)

This file is a **local development reference** for the split `messagePayload` architecture.
It is intentionally git-ignored.

## Goals

- Keep `messagePayload` maintainable as coverage grows
- Reuse small pieces in operations that need only part of payload behavior
- Keep one stable import surface for consumers

## Public Entry Points

- `./messagePayload.ts`
  - Backward-compatible facade used by existing operations/tests
  - Re-exports from `./messagePayload/index.ts`

- `./messagePayload/index.ts`
  - Public module surface
  - Exports:
    - `messagePayloadDescription`
    - `cardPayloadBuilderDescription`
    - `resolveMessagePayload`
    - `resolveCardPayload`
    - `resolveBotUniqueNameQueryParam`
    - `__testHelpers`

## Internal Module Map

### Core data + guards

- `messagePayload/constants.ts`
  - allowlists, mention patterns, size limits

- `messagePayload/common.ts`
  - safe JSON parsing and object safety checks
  - common coercion helpers (`getOptionalString`, `getOptionalBoolean`)
  - serialization helper for rich fields

### Text and mention logic

- `messagePayload/text.ts`
  - text validation
  - guided mention token building + insertion

### Bot identity helpers

- `messagePayload/bot.ts`
  - optional bot identity extraction
  - merge behavior for text/json/rich payload flows

### Buttons and action payloads

- `messagePayload/buttons.ts`
  - card/slide button extraction
  - raw vs structured action-data handling
  - type-specific action-data validation

### Slides parsing/normalization

- `messagePayload/slides.ts`
  - structured/raw slide extraction
  - table/list/label/image/text data normalization
  - per-slide button collection resolution

### Rich payload orchestration

- `messagePayload/rich.ts`
  - rich payload resolver pipeline
  - rich payload content-limit checks
  - card extraction
  - `resolveCardPayload`

### Main payload resolvers

- `messagePayload/resolvers.ts`
  - `resolveMessagePayload`
  - `resolveBotUniqueNameQueryParam`
  - re-export of `resolveCardPayload`

### UI descriptions

- `messagePayload/descriptions.ts`
  - `messagePayloadDescription`
  - `cardPayloadBuilderDescription`
  - description-level helper exports (`__testHelpers`)

- `messagePayload/slideCollectionValues.ts`
  - composes slide field sets into one `values` array

- `messagePayload/slideValues/*.ts`
  - per-slide-type UI chunks:
    - `images.ts`
    - `label.ts`
    - `list.ts`
    - `table.ts`
    - `text.ts`

## Reuse Patterns

### 1) Full message posting/scheduling flow

Use when operation supports full message type switch (`text`, `rich`, `json`).

- import `messagePayloadDescription`
- call `resolveMessagePayload(...)`
- if posting as bot is supported, call `resolveBotUniqueNameQueryParam(...)`

### 2) Card builder only

Use when operation only builds/returns card payload structures.

- import `cardPayloadBuilderDescription`
- call `resolveCardPayload(...)`

### 3) Need only bot query validation

Use when operation has bot posting query requirements but custom payload handling.

- call `resolveBotUniqueNameQueryParam(...)` only

### 4) Internal extension work (new message capabilities)

- If adding a new **slide type**:
  - update allowlist in `constants.ts`
  - add extraction/validation branch in `slides.ts`
  - add UI fields in `slideValues/<type>.ts`
  - include them in `slideCollectionValues.ts`
  - add/adjust tests in split messagePayload test files

- If adding a new **button action type**:
  - update action allowlist in `constants.ts`
  - update structured/raw validation in `buttons.ts`
  - add UI fields under `buttonCollectionValues` in `descriptions.ts`

## Test Layout (split to match architecture)

`__tests__/nodes/ZohoCliq/v1/actions/shared/messagePayload/`

- `textJsonBot.test.ts` - text/json + bot behavior
- `richSlidesA.test.ts` - rich/slides core behavior
- `richSlidesButtonsB.test.ts` - deeper slide/button branches
- `rawEdge.test.ts` - raw mode and edge validations
- `testUtils.ts` - shared context setup

## Quick Import Guidance

Prefer importing from the stable facade path in operations/tests:

```ts
import {
  messagePayloadDescription,
  resolveMessagePayload,
  resolveBotUniqueNameQueryParam,
} from '../shared/messagePayload';
```

Use internal module imports only when you are intentionally extending internals.
