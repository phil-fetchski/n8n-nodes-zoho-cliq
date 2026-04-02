# Thread: List Threads for Channel

Use this guide to configure **List Threads for Channel** for AI Tool mode in n8n.

This operation lists thread conversations for one Zoho Cliq channel, with optional follow-state, thread-state, and pagination controls.

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
List threads in Zoho Cliq for one channel. Successful responses return individual thread items with the most useful fields. Nested objects like `last_message_information` are flattened to `last_message_text` and `last_message_time`. An empty result set is still a valid successful response. When pagination is available, a `_pagination` element is included as the first item.

Required input:
- `channel_id`

Optional filters:
- `state` = `all` | `followed` | `not_followed`
- `type` = `open` | `closed`
- `limit`
- `next_token`
- `sync_token`

Example response:
[
  { "_pagination": { "has_more": true, "next_token": "...", "sync_token": "..." } },
  {
    "chat_id": "CT_9001245010012354810_3467821-T-9001245010938461210",
    "title": "Daily Updates",
    "thread_state": "open",
    "thread_message_id": "1629426730589_40288830613",
    "parent_chat_id": "CT_9001245010012354810_3467821",
    "parent_message_sender": "45321098",
    "is_follower": true,
    "follower_count": 5,
    "last_message_text": "Final report has been uploaded to the portal.",
    "last_message_time": "2024-12-12T10:45:00+05:30"
  }
]

Chaining guidance:
- use `chat_id` as the thread conversation identifier for Post to Thread, Get Main Message, and later thread follower/state operations
- use `_pagination.next_token` to request the next page
- use `_pagination.sync_token` alone, without `next_token`, to fetch changes since the last sync point
- use `title`, `is_follower`, and `thread_state` to decide which thread to act on next
```

### Simplify = Selected Fields

```txt
List threads in Zoho Cliq for one channel. Successful responses return individual thread items with only the configured Output Fields. `chat_id` is always included. An empty result set is still a valid successful response. When pagination is available, a `_pagination` element is included as the first item.

Required input:
- `channel_id`

Optional filters:
- `state` = `all` | `followed` | `not_followed`
- `type` = `open` | `closed`
- `limit`
- `next_token`
- `sync_token`

Example response:
[
  { "_pagination": { "has_more": true, "next_token": "...", "sync_token": "..." } },
  {
    "chat_id": "CT_9001245010012354810_3467821-T-9001245010938461210",
    "title": "Daily Updates"
  }
]

Chaining guidance:
- use `chat_id` as the thread conversation identifier for Post to Thread, Get Main Message, and later thread follower/state operations
- use `_pagination.next_token` to request the next page
- use `_pagination.sync_token` alone, without `next_token`, to fetch changes since the last sync point
```

### Simplify = Raw

```txt
List threads in Zoho Cliq for one channel. Returns the full API response wrapper with a `data` array and pagination fields. An empty `data` array is still a valid successful response.

Required input:
- `channel_id`

Optional filters:
- `state` = `all` | `followed` | `not_followed`
- `type` = `open` | `closed`
- `limit`
- `next_token`
- `sync_token`

Example response:
{
  "data": [
    {
      "parent_chat_id": "CT_9001245010012354810_3467821",
      "is_follower": true,
      "follower_count": 5,
      "chat_id": "CT_9001245010012354810_3467821-T-9001245010938461210",
      "title": "Daily Updates",
      "message_count": 19,
      "thread_state_info": {
        "thread_state": "open"
      },
      "last_message_information": {
        "sender_id": "45321098",
        "message_type": "text",
        "time": "2024-12-12T10:45:00+05:30",
        "text": "Final report has been uploaded to the portal."
      }
    }
  ],
  "has_more": true,
  "next_token": "<NEXT_TOKEN_HERE>",
  "sync_token": "<SYNC_TOKEN_HERE>",
  "type": "chat_thread",
  "url": "/api/v2/threads"
}

Chaining guidance:
- use `data[].chat_id` as the thread conversation identifier for Post to Thread, Get Main Message, and later thread follower/state operations
- use `next_token` to request the next page
- use `sync_token` alone, without `next_token`, to fetch changes since the last sync point
- use `data[].title`, `data[].message_count`, `data[].is_follower`, and `data[].thread_state_info.thread_state` to decide which thread to act on next
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Channel (Required)

- Plain text description:
```txt
Required Zoho Cliq channel ID for the channel whose threads should be listed. Use the exact channel ID in canonical form such as `P1234567890123456789`. Do not pass channel unique name here, channel ID ONLY.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_id', 'Required Zoho Cliq channel ID for the channel whose threads should be listed. Use the exact channel ID in canonical form such as P1234567890123456789. Do not pass channel unique name here, channel ID ONLY.', 'string') }}
```

---

### Additional Fields > Limit (Optional)

- Plain text description:
```txt
Optional whole-number page size. Use 1 to 100. In this tool schema, the default page size is 50.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('limit', 'Optional whole-number page size (limit). Use a whole number from 1 to 100.', 'number', 50) }}
```

---

### Additional Fields > Next Token (Optional)

- Plain text description:
```txt
Optional. Opaque pagination cursor returned by an earlier thread-list response. Use the exact `next_token` returned by the previous page. Blank is allowed and is omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('next_token', 'Optional. Opaque pagination cursor returned by an earlier thread-list response. Use the exact next_token returned by the previous page. Blank is allowed and is omitted.', 'string', '') }}
```

---

### Additional Fields > State (Optional)

- Plain text description:
```txt
Optional follow-state filter. ENUM: ["all", "followed", "not_followed"]. Use `all` for every thread, `followed` for only followed threads, or `not_followed` for only unfollowed threads.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('state', 'Optional follow-state filter. ENUM: [\"all\", \"followed\", \"not_followed\"]. Use all for every thread, followed for only followed threads, or not_followed for only unfollowed threads.', 'string', 'all') }}
```

---

### Additional Fields > Sync Token (Optional)

- Plain text description:
```txt
Optional. Opaque delta-sync cursor returned by an earlier thread-list response as `sync_token`. Use this token alone, without `next_token`, to fetch changes since the previous sync point. Blank is allowed and is omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('sync_token', 'Optional. Opaque delta-sync cursor returned by an earlier thread-list response as sync_token. Use this token alone, without next_token, to fetch changes since the previous sync point. Blank is allowed and is omitted.', 'string', '') }}
```

---

### Additional Fields > Type (Optional)

- Plain text description:
```txt
Optional thread-state filter. ENUM: ["open", "closed"]. Blank is allowed and is omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('type', 'Optional thread-state filter. ENUM: [\"open\", \"closed\"]. Blank is allowed and is omitted.', 'string', '') }}
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
Fields to include in the output when Simplify Mode is set to Selected Fields. The record ID is always included. Available fields: chat_id, title, thread_state, thread_message_id, parent_chat_id, parent_message_sender, is_follower, follower_count, last_message_information.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: chat_id, title, thread_state, thread_message_id, parent_chat_id, parent_message_sender, is_follower, follower_count, last_message_information. Return a JSON array of field names (e.g. ["chat_id","title"]) or a comma-separated string (e.g. "chat_id,title"). Both formats are accepted.', 'string', '["chat_id"]') }}
```
