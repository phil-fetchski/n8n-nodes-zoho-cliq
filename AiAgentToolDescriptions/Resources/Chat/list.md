# Chat: List Chats

Use this guide to configure **List Chats** for AI Agent Tool mode in n8n.

This operation lists chats in Zoho Cliq across multiple chat types, including `dm`, `bot`, `chat`, and `entity_chat`, with optional limit and last-modified filters.

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
List all chats in Zoho Cliq across multiple chat types, including dm, bot, chat, and entity_chat, with optional filters. Successful responses return individual chat items. Reuse each chat's `chat_id` for message, member, or chat-management operations. Nested objects like `last_message_info` are flattened to `last_message_text`. An empty result set is still a valid successful response. Use epoch-millisecond numbers for modified_after and modified_before. When limit truncates the result set, Zoho does not return a pagination cursor or next_token for continuing the list. If the returned chat count equals the requested limit, the results may be truncated.

For example:
[
  {
    "chat_id": "2230748224630350194",
    "name": "Ryan West",
    "chat_type": "dm",
    "participant_count": 2,
    "creation_time": "2019-10-15T03:37:28-07:00",
    "last_modified_time": "2024-01-15T10:30:00-07:00",
    "creator_id": "631830849",
    "pinned": false,
    "removed": false,
    "last_message_text": "Hello there!"
  }
]
```

### Simplify = Selected Fields

```txt
List all chats in Zoho Cliq across multiple chat types, including dm, bot, chat, and entity_chat, with optional filters. Successful responses return individual chat items with only the configured Output Fields. `chat_id` is always included. Reuse each chat's `chat_id` for message, member, or chat-management operations. An empty result set is still a valid successful response. Use epoch-millisecond numbers for modified_after and modified_before. When limit truncates the result set, Zoho does not return a pagination cursor or next_token for continuing the list.

For example:
[
  {
    "chat_id": "2230748224630350194",
    "name": "Ryan West",
    "chat_type": "dm"
  }
]
```

### Simplify = Raw

```txt
List all chats in Zoho Cliq across multiple chat types, including dm, bot, chat, and entity_chat, with optional filters. Returns an object with a chats array. Each chat entry may include name, creation_time, creator_id, last_modified_time, removed, recipients_summary, chat_type, chat_id, last_message_info, pinned, and participant_count. An empty chats array is still a valid successful response. Use epoch-millisecond numbers for modified_after and modified_before. When limit truncates the result set, Zoho does not return a pagination cursor or next_token for continuing the list. If the returned chat count equals the requested limit, the results may be truncated.

For example:
{
  "chats": [
    {
      "name": "Ryan West",
      "chat_id": "2230748224630350194",
      "chat_type": "dm",
      "pinned": false,
      "participant_count": 2,
      "last_modified_time": "2019-10-15T03:37:28-07:00",
      "last_message_info": {
        "text": "Hello there!",
        "time": 1571135848000
      }
    }
  ]
}
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Additional Fields > Limit (Optional)

- Plain text description:
```txt
Optional whole-number page size (limit). Use a whole number from 1 to 100.
Current Zoho responses do not include a pagination cursor or next_token when the result set is truncated by limit. If the returned chat count equals the requested limit, the results may be truncated.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('limit', 'Optional whole-number page size (limit). Use a whole number from 1 to 100.', 'number', 50) }}
```

---

### Additional Fields > Modified After (Optional)

- Plain text description:
```txt
Optional epoch-millisecond timestamp number for the modified_after filter. Use a whole number like 1735689600000. Use 0 (default) to omit this filter. The node sends this to Zoho Cliq as a numeric timestamp, not a quoted string. Zoho may return modified_after-filtered results oldest-to-newest, so do not assume the same sort order as the unfiltered default list.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('modified_after', 'Optional epoch-millisecond timestamp number for the modified_after filter. Use a whole number like 1735689600000. Use 0 (default) to omit this filter.', 'number', 0) }}
```

---

### Additional Fields > Modified Before (Optional)

- Plain text description:
```txt
Optional epoch-millisecond timestamp number for the modified_before filter. Use a whole number like 1735689600000. Use 0 (default) to omit this filter. If both modified_after and modified_before are provided, modified_after must not be later than modified_before. The node sends this to Zoho Cliq as a numeric timestamp, not a quoted string.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('modified_before', 'Optional epoch-millisecond timestamp number for the modified_before filter. Use a whole number like 1735689600000. Use 0 (default) to omit this filter. If both modified_after and modified_before are provided, modified_after must not be later than modified_before.', 'number', 0) }}
```

---

### Additional Fields > Drafts (Optional)

- Plain text description:
```txt
Optional boolean. Set true to return only chats that currently contain drafts. Leave false to omit the drafts filter.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('drafts', 'Optional boolean. Set true to return only chats that currently contain drafts. Leave false to omit the drafts filter.', 'boolean', false) }}
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
Fields to include in the output when Simplify Mode is set to Selected Fields. The record ID is always included. Available fields: chat_id, name, chat_type, participant_count, creation_time, last_modified_time, creator_id, pinned, removed, recipients_summary, last_message_info.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: chat_id, name, chat_type, participant_count, creation_time, last_modified_time, creator_id, pinned, removed, recipients_summary, last_message_info. Return a JSON array of field names (e.g. ["chat_id","name"]) or a comma-separated string (e.g. "chat_id,name"). Both formats are accepted.', 'string', '["chat_id"]') }}
```
