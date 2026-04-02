# Calls & Meetings: List Call Recordings

Use this guide to configure **List Call Recordings** for AI Agent Tool mode in n8n.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- The **Simplify** toggle is ON by default, returning simplified output. Turn it OFF for the full raw API response. When ON, use the **Simplify Mode** selector to choose between Simplified, Raw, or Selected Fields — see the **Simplify Output** section below for mode details, Tool Description selection instructions, and guidance on editing the Selected Fields template.

## Important Disclaimer

### Every Input Has an Example — Use Only What You Need

This guide provides a description and `$fromAI()` expression for **every** input so you have a ready-made starting point for each one. This is **not** a recommendation to enable them all on any given tool. Every workflow is different — give your agent control over only the inputs it genuinely needs to decide.

- **Hardcode what doesn't change.** If a value is the same every run (e.g., always posting to the same channel), hardcode it or use a standard n8n expression. There is no reason for the agent to provide what it doesn't need to decide.
- **Every token costs money.** Each `$fromAI()` field adds tokens to every agent invocation. More fields mean higher cost per run — configure deliberately.
- **Security surface.** Each agent-controlled field is a runtime decision you are delegating to a model. The more you delegate, the larger the blast radius if intent is misinterpreted. Grant only the minimum access your workflow requires.

### Liability Notice

By configuring AI agent access to your Zoho Cliq account, **you accept full responsibility** for any changes the agent makes — including messages sent, channels created or deleted, users modified or removed, and any other account changes. The node developer accepts **zero liability** for any outcome resulting from agent actions on your account.

Test in a non-production environment first and **use a capable frontier model from a major lab**.

## Simplify Output

The **Simplify** toggle (ON by default) controls the response shape returned to the Agent. When ON, the **Simplify Mode** selector offers three modes:

| Simplify | Simplify Mode | Behavior |
|---|---|---|
| ON | **Simplified** (default) | Most useful fields per item, nested objects flattened. |
| ON | **Raw** | Full API response as-is — single wrapper with array and pagination keys. |
| ON | **Selected Fields** | Only your chosen **Output Fields**. Record ID always included. |
| OFF | *(hidden)* | Full API response as-is (same as Raw). |

In **Simplified** or **Selected Fields** mode, each record is its own n8n output item (no Split Out needed). If pagination keys exist (`has_more`, `next_token`, `sync_token`), a `_pagination` object is prepended as the first item. In **Raw** mode, the response is a single wrapper object.

Configure Simplify, Simplify Mode, and Output Fields manually rather than delegating to the Agent. Three Tool Descriptions are provided below — **copy the one matching your Simplify mode**. The **Selected Fields** version is a template: edit its example response to list only the fields you configured in Output Fields. `$fromAI()` expressions are also provided if you prefer agent-controlled output.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

Use the Tool Description that matches your configured **Simplify** mode:

### Simplify = Simplified (default)

```txt
List call recordings and media session history in Zoho Cliq. Call Recordings === Media Sessions in Cliq API. Successful responses return individual media session items with the most useful fields. The nested `host.name` field is flattened to `host_name`. An empty result set is still a valid successful response. When pagination is available, a `_pagination` element is included as the first item.

Optional filters:
- `type` = `all` | `handshake` | `assembly` | `audio_conference` | `video_conference` | `direct_call`
- `filter` = `live` | `viewed` | `scheduled` | `missed` | `received` | `dialled` (missed/received/dialled require type direct_call)
- `search` (call title search text)
- `limit` (1–100)
- `from` (lower-bound Unix ms)
- `to` (upper-bound Unix ms)
- `last_modified` (Unix ms)
- `host_id` (digits only)
- `recipient_id` (digits only)
- `recipient_ids` (comma-separated digits)
- `next_token`
- `sync_token`

Token exclusivity rule: when sync_token or next_token is present, no other query filters are allowed.

Example response:
[
  { "_pagination": { "next_token": "...", "sync_token": "..." } },
  {
    "id": "123456789",
    "session_id": "SESSION_123456789",
    "type": "audio_conference",
    "title": "Incident Bridge",
    "scope": "organization",
    "start_time": 1741276800000,
    "end_time": 1741278600000,
    "host_name": "Alex Rivera",
    "participant_count": 6,
    "recording": {}
  }
]

Chaining guidance:
- use `id` as the media session identifier for downstream operations
- use `_pagination.next_token` to request the next page
- use `_pagination.sync_token` alone, without `next_token`, to fetch changes since the last sync point
- use `title`, `type`, and `scope` to decide which session to act on next
```

### Simplify = Selected Fields

```txt
List call recordings and media session history in Zoho Cliq. Call Recordings === Media Sessions in Cliq API. Successful responses return individual media session items with only the configured Output Fields. `id` is always included. An empty result set is still a valid successful response. When pagination is available, a `_pagination` element is included as the first item.

Optional filters:
- `type` = `all` | `handshake` | `assembly` | `audio_conference` | `video_conference` | `direct_call`
- `filter` = `live` | `viewed` | `scheduled` | `missed` | `received` | `dialled` (missed/received/dialled require type direct_call)
- `search` (call title search text)
- `limit` (1–100)
- `from` (lower-bound Unix ms)
- `to` (upper-bound Unix ms)
- `last_modified` (Unix ms)
- `host_id` (digits only)
- `recipient_id` (digits only)
- `recipient_ids` (comma-separated digits)
- `next_token`
- `sync_token`

Token exclusivity rule: when sync_token or next_token is present, no other query filters are allowed.

Example response:
[
  { "_pagination": { "next_token": "...", "sync_token": "..." } },
  {
    "id": "123456789",
    "title": "Incident Bridge"
  }
]

Chaining guidance:
- use `id` as the media session identifier for downstream operations
- use `_pagination.next_token` to request the next page
- use `_pagination.sync_token` alone, without `next_token`, to fetch changes since the last sync point
```

### Simplify = Raw

```txt
List call recordings and media session history in Zoho Cliq. Call Recordings === Media Sessions in Cliq API. Returns the full API response wrapper with a `data` array and pagination fields. An empty `data` array is still a valid successful response.

Optional filters:
- `type` = `all` | `handshake` | `assembly` | `audio_conference` | `video_conference` | `direct_call`
- `filter` = `live` | `viewed` | `scheduled` | `missed` | `received` | `dialled` (missed/received/dialled require type direct_call)
- `search` (call title search text)
- `limit` (1–100)
- `from` (lower-bound Unix ms)
- `to` (upper-bound Unix ms)
- `last_modified` (Unix ms)
- `host_id` (digits only)
- `recipient_id` (digits only)
- `recipient_ids` (comma-separated digits)
- `next_token`
- `sync_token`

Token exclusivity rule: when sync_token or next_token is present, no other query filters are allowed.

Example response:
{
  "data": [
    {
      "id": "123456789",
      "session_id": "SESSION_123456789",
      "nrs_id": "NRS_123456789",
      "type": "audio_conference",
      "title": "Incident Bridge",
      "scope": "organization",
      "host": {
        "id": "987654321",
        "name": "Alex Rivera"
      },
      "participant_count": 6,
      "start_time": 1741276800000,
      "end_time": 1741278600000,
      "recording": {},
      "notes": {},
      "is_partial": false,
      "chat_id": "CT_123456789",
      "chat": {}
    }
  ],
  "next_token": "next-page-token",
  "sync_token": "sync-cursor-token"
}

Chaining guidance:
- use `data[].id` as the media session identifier for downstream operations
- use `next_token` to request the next page
- use `sync_token` alone, without `next_token`, to fetch changes since the last sync point
- use `data[].title`, `data[].type`, `data[].scope`, `data[].host`, `data[].notes`, and `data[].chat` to decide which session to act on next
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Additional Fields > Type (Optional)

- Plain text description:
```txt
Optional media session types. ENUM: ["all", "handshake", "assembly", "audio_conference", "video_conference", "direct_call"].
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('type', 'Optional media session types. ENUM: ["all", "handshake", "assembly", "audio_conference", "video_conference", "direct_call"].', 'string', '') }}
```

---

### Additional Fields > Filter (Optional)

- Plain text description:
```txt
Optional history filter. ENUM: ["live", "viewed", "scheduled", "missed", "received", "dialled"]. missed/received/dialled require type direct_call and cannot be used when type is all.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('filter', 'Optional history filter. ENUM: ["live", "viewed", "scheduled", "missed", "received", "dialled"]. missed/received/dialled require type direct_call and cannot be used when type is all.', 'string', '') }}
```

---

### Additional Fields > Search (Optional)

- Plain text description:
```txt
Optional call title search text.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('search', 'Optional call title search text.', 'string', '') }}
```

---

### Additional Fields > Sync Token (Optional)

- Plain text description:
```txt
Optional. Opaque sync cursor returned as sync_token. Use this token alone (without next_token) to fetch only new calls/media_sessions added since the previous sync point.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('sync_token', 'Optional. Opaque sync cursor returned by the API as sync_token. Use this token alone (without next_token) to fetch only new calls/media_sessions since the previous sync point.', 'string', '') }}
```

---

### Additional Fields > Next Token (Optional)

- Plain text description:
```txt
Optional. Opaque pagination cursor returned as next_token in the previous response. Reuse exactly as returned to fetch the next page of standard pagination results. Do not combine with sync_token.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('next_token', 'Optional. Opaque pagination cursor returned by the previous response as next_token. Reuse exactly as returned to fetch the next page of standard pagination results. Do not combine with sync_token.', 'string', '') }}
```

---

### Token Exclusivity Rule (Enforced)

```txt
When sync_token or next_token is present, no other query filters are allowed.
```

```txt
Enforced in runtime validation in listCallRecordings.operation.ts:
- If additionalFields.syncToken or additionalFields.nextToken is set, the operation rejects requests that also include any of:
  type, search, limit, from, to, last_modified, filter, host_id, recipient_id, recipient_ids.
- Error message: "Next Token and Sync Token cannot be combined with any other query parameter".
```

```txt
UI hint for users:
- If you set additionalFields.nextToken (next_token) or sync_token, clear all other filter fields first.
```

---

### Additional Fields > Limit (Optional)

- Plain text description:
```txt
Optional page size (limit). Use a whole number from 1 to 100.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('limit', 'Optional page size (limit). Use a whole number from 1 to 100.', 'number', 50) }}
```

---

### Additional Fields > From Time (Optional)

- Plain text description:
```txt
Optional lower-bound Unix timestamp in milliseconds (from) for media sessions.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('from', 'Optional lower-bound Unix timestamp in milliseconds (from) for media sessions.', 'number', 0) }}
```

---

### Additional Fields > To Time (Optional)

- Plain text description:
```txt
Optional upper-bound Unix timestamp in milliseconds (to) for media sessions.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('to', 'Optional upper-bound Unix timestamp in milliseconds (to) for media sessions.', 'number', 0) }}
```

---

### Additional Fields > Last Modified Time (Optional)

- Plain text description:
```txt
Optional Unix timestamp in milliseconds (last_modified). Returns sessions modified after this time.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('last_modified', 'Optional Unix timestamp in milliseconds (last_modified). Returns sessions modified after this time.', 'number', 0) }}
```

---

### Additional Fields > Host ID (Optional)

- Plain text description:
```txt
Optional host user ID filter (host_id). Digits only.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('host_id', 'Optional host user ID filter (host_id). Digits only.', 'string', '') }}
```

---

### Additional Fields > Recipient ID (Optional)

- Plain text description:
```txt
Optional recipient user ID filter (recipient_id). Use to filter for a single recipient by ID. Digits only.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('recipient_id', 'Optional recipient user ID filter (recipient_id). Use to filter for a single recipient by ID. Digits only. Example: 987654321', 'string', '') }}
```

---

### Additional Fields > Recipient IDs (Optional)

- Plain text description:
```txt
Optional comma-separated recipient user IDs (recipient_ids). Use to filter by MULTIPLE Users by User ID in csv format. Digits only per ID.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('recipient_ids', 'Optional comma-separated recipient user IDs (recipient_ids). Use to filter by MULTIPLE Users by user_id in csv format. Digits only per ID. Example: 987654321,987654322', 'string', '') }}
```

---

### Simplify (Optional — recommended to set manually)

- Plain text description:
```txt
Whether to return a simplified version of the response instead of the raw data. When enabled (default), the Simplify Mode selector controls the output shape. When disabled, the full raw API response is returned.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplify', 'Whether to simplify the response. Set to true (default) for simplified output or false for the full raw API response.', 'boolean', 'true') }}
```

---

### Simplify Mode (Optional — shown when Simplify = enabled, recommended to set manually)

- Plain text description:
```txt
How to simplify the response output. Use 'simplified' for the most useful fields only (default), 'raw' for the complete API response, or 'selectedFields' to choose specific fields via Output Fields. ENUM: ["simplified", "raw", "selectedFields"].
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyMode', "How to simplify the response output. Use 'simplified' for the most useful fields only (default), 'raw' for the complete API response, or 'selectedFields' to choose specific fields via Output Fields. ENUM: [\"simplified\", \"raw\", \"selectedFields\"].", 'string', 'simplified') }}
```

---

### Output Fields (Optional — shown when Simplify Mode = Selected Fields)

- Plain text description:
```txt
Fields to include in the output when Simplify Mode is set to Selected Fields. The record ID is always included. Available fields: id, session_id, type, title, scope, start_time, end_time, host, participant_count, recording, notes, is_partial, nrs_id, chat_id, chat.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: id, session_id, type, title, scope, start_time, end_time, host, participant_count, recording, notes, is_partial, nrs_id, chat_id, chat. Return a JSON array of field names (e.g. ["id","title"]) or a comma-separated string (e.g. "id,title"). Both formats are accepted.', 'string', '["id"]') }}
```
