# Channel: Update Channel

Use this guide to configure **Update Channel** for AI Agent Tool mode in n8n.

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
| ON | **Simplified** (default) | Most useful fields only, nested objects flattened. |
| ON | **Raw** | Full API response as-is, including wrapper object. |
| ON | **Selected Fields** | Only your chosen **Output Fields**. Record ID always included. |
| OFF | *(hidden)* | Full API response as-is (same as Raw). |

Configure Simplify, Simplify Mode, and Output Fields manually rather than delegating to the Agent. Three Tool Descriptions are provided below — **copy the one matching your Simplify mode**. The **Selected Fields** version is a template: edit its example response to list only the fields you configured in Output Fields. `$fromAI()` expressions are also provided if you prefer agent-controlled output.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

Use the Tool Description that matches your configured **Simplify** mode:

### Simplify = Simplified (default)

```txt
Update channel metadata and configuration in Zoho Cliq, including channel display name, description, image data, and config options.

This Tool Updates Existing Channels Only, it does NOT Create New Channels. This Tool Cannot add or remove Members of a Channel.

You Must have a channel_id in order to call this tool, channel unique name cannot be used here.

Successful responses return a flat object with the most useful fields, including the IDs you need for follow-up calls. Reuse channel_id directly.

For example:
{
  "updated": true,
  "channel_id": "P1234567890123456789",
  "name": "#Engineering",
  "unique_name": "engineering",
  "description": "Updated channel description",
  "level": "private",
  "status": "created",
  "participant_count": 3,
  "creation_time": "2026-03-06T12:00:00-05:00",
  "creator_name": "Example User",
  "current_user_role": "super_admin"
}
```

### Simplify = Selected Fields

```txt
Update channel metadata and configuration in Zoho Cliq, including channel display name, description, image data, and config options.

This Tool Updates Existing Channels Only, it does NOT Create New Channels. This Tool Cannot add or remove Members of a Channel.

You Must have a channel_id in order to call this tool, channel unique name cannot be used here.

Successful responses return only the configured Output Fields. channel_id is always included. Reuse channel_id for follow-up calls.

For example:
{
  "updated": true,
  "channel_id": "P1234567890123456789",
  "name": "#Engineering",
  "level": "private"
}
```

### Simplify = Raw

```txt
Update channel metadata and configuration in Zoho Cliq, including channel display name, description, image data, and config options.

This Tool Updates Existing Channels Only, it does NOT Create New Channels. This Tool Cannot add or remove Members of a Channel.

You Must have a channel_id in order to call this tool, channel unique name cannot be used here.

Successful responses return the full channel object with all available fields. Reuse channel_id directly.

For example:
{
  "updated": true,
  "channel_id": "P1234567890123456789",
  "name": "#Engineering",
  "unique_name": "engineering",
  "description": "Updated channel description",
  "level": "private",
  "status": "created",
  "participant_count": 3,
  "creation_time": "2026-03-06T12:00:00-05:00",
  "last_modified_time": "2026-03-06T12:15:00-05:00",
  "creator_id": "123456789",
  "creator_name": "Example User",
  "current_user_role": "super_admin",
  "organization_id": "987654321",
  "invite_only": false,
  "joined": true,
  "pinned": false,
  "chat_id": "CT_1234567890123456789_123456789",
  "image_url": "https://cliq.zoho.com/channel/.../photo.do",
  "total_message_count": "0",
  "unread_message_count": "0",
  "unread_time": "",
  "teams": {},
  "last_message_info": {},
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
Required channel selector for the channel you want to update. Do not use channel unique name here.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_id', 'Required channel ID in Zoho Cliq to update. Pass only the canonical channel ID string (for example, P1234567890123456789). Do not pass channel unique name here, channel ID ONLY.', 'string') }}
```

---

### Config Setup Recommendation For AI Tool Use

#### Manual Setup Note

Best practice for AI Tool use: manually set `Update Fields > Config Input Mode = Using JSON` in the n8n UI, and do not expose that selector to the agent. Keep Using Fields Below for normal human-built workflows only. If you do not want to send channel config at all, leave `Config Input Mode = None` and do not enable `Config JSON` for AI.

---

### Update Fields > Config JSON (Recommended AI Path)

- Plain text description:
```txt
Recommended config field for AI Tool use. Before enabling AI control for this field, manually set Update Fields > Config Input Mode = Using JSON. Accepted JSON object keys and values:
- reply_mode: "normal_reply" | "threads" | "both"
- leave_join_info: "enable" | "disable"
- add_remove_info: "enable" | "disable"
- meeting_chat_type: "channel" | "thread" | "host_choice"
Use an object like {"reply_mode":"normal_reply","leave_join_info":"enable","add_remove_info":"enable","meeting_chat_type":"channel"} as a safe baseline for most updates. "Blank/empty" means the entire Config JSON field is omitted, an empty string, or an empty object {}. Do not set individual keys to "" or null. The node rejects defined config keys with empty or null values, so omit those keys entirely instead. Unsafe keys (__proto__, constructor, prototype) are rejected.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('config_json', 'Recommended raw JSON config object for channel update. Allowed keys: reply_mode ("normal_reply" | "threads" | "both"), leave_join_info ("enable" | "disable"), add_remove_info ("enable" | "disable"), meeting_chat_type ("channel" | "thread" | "host_choice"). The tool accepts either a stringified JSON object or a literal JSON object. Omit any key you do not want to send. Do not set keys to empty strings or null because the node rejects defined config keys with empty/null values.', 'string', {}) }}
```

---

### Update Fields > Description (Optional)

- Plain text description:
```txt
Optional new channel description. Blank values are allowed and treated as omitted. Max length 10500.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('description', 'Optional new channel description. Blank values are allowed and treated as omitted. Only use relevant, human readable descriptions that are accurate to the Channel being updated. Only update the channel description if necessary. Max 10500 characters.', 'string', '') }}
```

---

### Update Fields > Image Data (Base64) (Optional)

- Plain text description:
```txt
Optional channel image payload as inline base64 content. Only base64 strings are accepted here, if you do not have access to an image that is base64 encoded than do not use this param. Do not provide a normal image URL. A data URL is acceptable only if it contains base64 image data inline. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('image_data', 'Optional channel image payload as inline base64 content. Only base64 strings are accepted here, if you do not have access to an image that is base64 encoded than do not use this param. Do not provide a normal image URL. A data URL is acceptable only when it contains base64 image data inline. Leave blank to omit.', 'string', '') }}
```

---

### Update Fields > Name (Optional)

- Plain text description:
```txt
Optional new display name. Blank values are allowed and treated as omitted. This is NOT a channel unique name, channel unique name is generated by Cliq when a channel is created and cannot be modified after. This channel display name CAN be modified as many times as needed. Max length 50.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('name', 'Optional new channel display name. Blank values are allowed and treated as omitted. This is NOT a channel unique name, channel unique name is generated by Cliq when a channel is created and cannot be modified after. This channel display name CAN be modified as many times as needed. Max 50 characters.', 'string', '') }}
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
Fields to include in the output when Simplify Mode is set to Selected Fields. The channel_id is always included. Available fields: channel_id, name, unique_name, description, level, status, participant_count, creation_time, last_modified_time, creator_id, creator_name, current_user_role, organization_id, invite_only, joined, pinned, chat_id, image_url, total_message_count, unread_message_count, unread_time, teams, last_message_info, admin_permission, moderator_permission, member_permission.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: channel_id, name, unique_name, description, level, status, participant_count, creation_time, last_modified_time, creator_id, creator_name, current_user_role, organization_id, invite_only, joined, pinned, chat_id, image_url, total_message_count, unread_message_count, unread_time, teams, last_message_info, admin_permission, moderator_permission, member_permission. Return a JSON array of field names (e.g. ["channel_id","name"]) or a comma-separated string (e.g. "channel_id,name"). Both formats are accepted.', 'string', '["channel_id"]') }}
```
