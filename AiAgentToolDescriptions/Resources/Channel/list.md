# Channel: List Channels

Use this guide to configure **List Channels** for AI Agent Tool mode in n8n.

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
List channels in Zoho Cliq with optional filters for status, level, joined state, pinned state, IDs, creator, timestamps, and pagination tokens. Successful responses return individual channel items. When pagination metadata exists, the first item is a `_pagination` object containing `has_more`, `next_token`, and `sync_token`. Reuse each channel's `channel_id` for get, join, leave, change-role, change-permission, and other channel operations, and reuse `next_token` from `_pagination` to fetch the next page.

For example:
[
  { "_pagination": { "has_more": true, "next_token": "next-page-token-or-null", "sync_token": "sync-token-or-null" } },
  {
    "channel_id": "P1234567890123456789",
    "name": "#Engineering",
    "unique_name": "engineering",
    "description": "Engineering team channel",
    "level": "private",
    "status": "created",
    "participant_count": 12,
    "creation_time": "2024-01-15T10:30:00Z",
    "creator_name": "Scott Fisher",
    "current_user_role": "member"
  }
]
```

### Simplify = Selected Fields

```txt
List channels in Zoho Cliq with optional filters for status, level, joined state, pinned state, IDs, creator, timestamps, and pagination tokens. Successful responses return individual channel items with only the configured Output Fields. `channel_id` is always included. When pagination metadata exists, the first item is a `_pagination` object containing `has_more`, `next_token`, and `sync_token`. Reuse each channel's `channel_id` for get, join, leave, change-role, change-permission, and other channel operations, and reuse `next_token` from `_pagination` to fetch the next page.

For example:
[
  { "_pagination": { "has_more": true, "next_token": "next-page-token-or-null", "sync_token": "sync-token-or-null" } },
  {
    "channel_id": "P1234567890123456789",
    "name": "#Engineering",
    "level": "private"
  }
]
```

### Simplify = Raw

```txt
List channels in Zoho Cliq with optional filters for status, level, joined state, pinned state, IDs, creator, timestamps, and pagination tokens. The node normalizes responses into a stable object with channels and pagination metadata. Reuse channels[].channel_id for get, join, leave, change-role, change-permission, and other channel operations, and reuse next_token to fetch the next page.

For example:
{
  "channels": [
    {
      "name": "#Engineering",
      "channel_id": "P1234567890123456789",
      "chat_id": "CT_1234567890123456789_123456789",
      "unique_name": "engineering",
      "level": "private",
      "status": "created",
      "participant_count": 12,
      "joined": true,
      "pinned": false,
      "current_user_role": "member",
      "admin_permission": {
        "send_message": true,
        "delete_channel": true
      },
      "moderator_permission": {
        "send_message": true,
        "delete_channel": false
      },
      "member_permission": {
        "send_message": true,
        "delete_channel": false
      }
    }
  ],
  "has_more": true,
  "next_token": "next-page-token-or-null",
  "sync_token": "sync-token-or-null"
}
If Zoho returns no channels, the node still returns channels: [] and normalized pagination values. Many of the values in the response from this Tool can be used for chaining in a variety of other Zoho Cliq tools.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Level (Optional)

- Plain text description:
```txt
Optional channel level filter. ENUM: ["organization", "team", "private", "external"]. This does not exclude archived channels by itself, so combine with status=created when you want active channels only.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('level', 'Optional channel level filter. ENUM: ["organization", "team", "private", "external"]. To scope to active channels only, combine with status=created.', 'string', '') }}
```

---

### Status (Optional)

- Plain text description:
```txt
Optional channel status filter. ENUM: ["created", "pending", "archived"].
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('status', 'Optional channel status filter. ENUM: ["created", "pending", "archived"].', 'string', '') }}
```

---

### Joined (Optional)

- Plain text description:
```txt
Optional membership-state filter. Use true for joined channels only, false for not-joined channels only, or leave blank for all channels.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('joined', 'Optional membership-state filter. Use true for joined channels only, false for not-joined channels only, or leave blank for all channels.', 'string', '') }}
```

---

### Pinned Only (Optional)

- Plain text description:
```txt
Optional pinned filter. true returns only pinned channels. Leave blank or false to avoid filtering by pinned state.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('pinned', 'Optional pinned filter. true returns only pinned channels. Leave blank or false to avoid filtering by pinned state.', 'boolean', false) }}
```

---

### Additional Fields > Channel IDs (Optional)

- Plain text description:
```txt
Optional comma-separated channel IDs. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_ids', 'Optional comma-separated channel IDs. Blank values are allowed and treated as omitted.', 'string', '') }}
```

---

### Additional Fields > Channel Name (Optional)

- Plain text description:
```txt
Optional server-side display-name filter. Supports substring matching, so partial names, prefixes, and suffixes all work. The # prefix is not required. This filters the channel display name only, not the unique name. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('name', 'Optional server-side display-name filter. Supports substring matching, so partial names, prefixes, and suffixes all work. The # prefix is not required. This filters the channel display name only, not the unique name. Blank values are allowed and treated as omitted.', 'string', '') }}
```

---

### Additional Fields > Chat IDs (Optional)

- Plain text description:
```txt
Optional comma-separated chat IDs for channels. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('chat_ids', 'Optional comma-separated chat IDs for channels. Blank values are allowed and treated as omitted.', 'string', '') }}
```

---

### Additional Fields > Created After (Optional)

- Plain text description:
```txt
Optional creation-time lower bound. You can provide ISO 8601 date-time input, and the node converts it to epoch milliseconds for the API.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('created_after', 'Optional creation-time lower bound. Provide ISO 8601 date-time input or epoch milliseconds; the node sends epoch milliseconds to the API.', 'string', '') }}
```

---

### Additional Fields > Created Before (Optional)

- Plain text description:
```txt
Optional creation-time upper bound. You can provide ISO 8601 date-time input, and the node converts it to epoch milliseconds for the API.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('created_before', 'Optional creation-time upper bound. Provide ISO 8601 date-time input or epoch milliseconds; the node sends epoch milliseconds to the API.', 'string', '') }}
```

---

### Additional Fields > Created By (Optional)

- Plain text description:
```txt
Optional creator filter (email or user ID). Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('created_by', 'Optional creator filter using email or user ID. Blank values are allowed and treated as omitted.', 'string', '') }}
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

### Additional Fields > Modified After (Optional)

- Plain text description:
```txt
Optional last-modified lower bound. You can provide ISO 8601 date-time input, and the node converts it to epoch milliseconds for the API.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('modified_after', 'Optional last-modified lower bound. Provide ISO 8601 date-time input or epoch milliseconds; the node sends epoch milliseconds to the API.', 'string', '') }}
```

---

### Additional Fields > Modified Before (Optional)

- Plain text description:
```txt
Optional last-modified upper bound. You can provide ISO 8601 date-time input, and the node converts it to epoch milliseconds for the API.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('modified_before', 'Optional last-modified upper bound. Provide ISO 8601 date-time input or epoch milliseconds; the node sends epoch milliseconds to the API.', 'string', '') }}
```

---

### Additional Fields > Next Token (Optional)

- Plain text description:
```txt
Optional. Opaque pagination cursor returned as next_token in the previous response. Reuse exactly as returned to fetch the next page of standard pagination results. Do not combine with sync_token; that is a separate delta-sync cursor from an earlier response, not a free-form value to invent.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('next_token', 'Optional. Opaque pagination cursor returned by the previous response as next_token. Reuse exactly as returned to fetch the next page of standard pagination results. Do not combine with sync_token; that is a separate delta-sync cursor from an earlier response, not a free-form value to invent.', 'string', '') }}
```

---

### Additional Fields > Order By (Optional)

- Plain text description:
```txt
Optional sort key. ENUM: ["+last_modified_time", "-last_modified_time", "+creation_time", "-creation_time"]. Example: -last_modified_time returns most recently updated channels first.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('order_by', 'Optional sort key. ENUM: ["+last_modified_time", "-last_modified_time", "+creation_time", "-creation_time"]. Example: -last_modified_time returns most recently updated channels first.', 'string', '-last_modified_time') }}
```

---

### Additional Fields > Sync Token (Optional)

- Plain text description:
```txt
Optional. Opaque delta-sync cursor returned as sync_token by an earlier response. Use this token alone, without next_token, to fetch channels updated since the previous sync point. sync_token may be null on intermediate pages and is most useful after the final page of a result set.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('sync_token', 'Optional. Opaque delta-sync cursor returned by an earlier API response as sync_token. Use this token alone, without next_token, to fetch channels updated since the previous sync point. Do not combine it with next_token. sync_token may be null on intermediate pages and is most useful after the final page of a result set.', 'string', '') }}
```

---

### Additional Fields > Team IDs (Optional)

- Plain text description:
```txt
Optional comma-separated team IDs. Zoho documents this as a server-side filter, but live behavior may ignore it and still return channels outside those teams. Validate the returned teams data before assuming the filter was enforced. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('team_ids', 'Optional comma-separated team IDs. Zoho documents this as a server-side filter, but live behavior may ignore it and still return channels outside those teams. Validate the returned teams data before assuming the filter was enforced. Blank values are allowed and treated as omitted.', 'string', '') }}
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
Fields to include in the output when Simplify Mode is set to Selected Fields. The record ID is always included. Available fields: channel_id, name, unique_name, description, level, status, participant_count, creation_time, last_modified_time, creator_id, creator_name, current_user_role, organization_id, invite_only, joined, pinned, chat_id, image_url, total_message_count, unread_message_count, unread_time, teams, last_message_info, admin_permission, moderator_permission, member_permission.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: channel_id, name, unique_name, description, level, status, participant_count, creation_time, last_modified_time, creator_id, creator_name, current_user_role, organization_id, invite_only, joined, pinned, chat_id, image_url, total_message_count, unread_message_count, unread_time, teams, last_message_info, admin_permission, moderator_permission, member_permission. Return a JSON array of field names (e.g. ["channel_id","name"]) or a comma-separated string (e.g. "channel_id,name"). Both formats are accepted.', 'string', '["channel_id"]') }}
```
