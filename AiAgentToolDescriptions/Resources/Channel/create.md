# Channel: Create Channel

Use this guide to configure **Create Channel** for AI Agent Tool mode in n8n.

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
Create new channel in Zoho Cliq with required name and level, plus optional description, invite-only mode, participant lists, team_ids, image data, and config settings. Returns a flat object with the most useful fields, including the IDs you need for follow-up calls. Reuse channel_id directly.

For example:
{
  "channel_id": "P1234567890123456789",
  "name": "#Engineering",
  "unique_name": "engineering",
  "description": "",
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
Create new channel in Zoho Cliq with required name and level, plus optional description, invite-only mode, participant lists, team_ids, image data, and config settings. Returns only the configured Output Fields. channel_id is always included. Reuse channel_id for follow-up calls.

For example:
{
  "channel_id": "P1234567890123456789",
  "name": "#Engineering",
  "level": "private"
}
```

### Simplify = Raw

```txt
Create new channel in Zoho Cliq with required name and level, plus optional description, invite-only mode, participant lists, team_ids, image data, and config settings. Returns the full channel object with all available fields. Reuse channel_id directly.

For example:
{
  "channel_id": "P1234567890123456789",
  "name": "#Engineering",
  "unique_name": "engineering",
  "description": "",
  "level": "private",
  "status": "created",
  "participant_count": 3,
  "creation_time": "2026-03-06T12:00:00-05:00",
  "last_modified_time": "2026-03-06T12:00:00-05:00",
  "creator_id": "123456789",
  "creator_name": "Example User",
  "current_user_role": "super_admin",
  "organization_id": "987654321",
  "invite_only": false,
  "joined": true,
  "pinned": false,
  "chat_id": "CT_1234567890123456789_123456789",
  "image_url": "",
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

### Channel Name (Required)

- Plain text description:
```txt
Required channel display name. Runtime trims whitespace and enforces max length 50.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_name', 'Required channel display name. Max 50 characters.', 'string') }}
```

---

### Level (Required)

- Plain text description:
```txt
Required channel level. ENUM: ["organization", "team", "private", "external"].
- organization = org-wide public channel
- team = channel associated with one or more specific teams
- private = invite-only participant channel
- external = channel with outside participants
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_level', 'Required channel level. ENUM: ["organization", "team", "private", "external"]. organization = org-wide public channel, team = tied to one or more teams, private = invite-only participant channel, external = includes outside participants.', 'string') }}
```

---

### Additional Fields > Add Participants (Optional)

- Plain text description:
```txt
Optional comma-separated participant email list. You may provide this together with user_ids; the node forwards both lists if both are supplied, and Zoho does not document precedence. Prefer one identifier type when possible. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('email_ids', 'Optional comma-separated participant email addresses. You may combine this with user_ids, but Zoho does not document precedence, so prefer one identifier type when possible. Leave blank to omit.', 'string', '') }}
```

---

### Additional Fields > Add Participants by User ID (Optional)

- Plain text description:
```txt
Optional comma-separated Zoho user IDs to add as participants during create. You may provide this together with email_ids; the node forwards both lists if both are supplied, and Zoho does not document precedence. Prefer one identifier type when possible. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('user_ids', 'Optional comma-separated Zoho user IDs to add during channel creation. You may combine this with email_ids, but Zoho does not document precedence, so prefer one identifier type when possible. Leave blank to omit.', 'string', '') }}
```

---

### Config Setup Recommendation For AI Tool Use

#### Manual Setup Note

Best practice for AI Tool use: manually set `Config Input Mode = Using JSON` in the n8n UI, and do not expose that selector to the agent. Keep Using Fields Below for normal human-built workflows only. If you do not want to send channel config at all, leave `Config Input Mode = None` and do not enable `Config JSON` for AI.

---

### Config JSON (Recommended AI Path)

- Plain text description:
```txt
Recommended config field for AI Tool use. Before enabling AI control for this field, manually set Config Input Mode = Using JSON. Accepted JSON object keys and values:
- reply_mode: "normal_reply" | "threads" | "both"
- leave_join_info: "enable" | "disable"
- add_remove_info: "enable" | "disable"
- meeting_chat_type: "channel" | "thread" | "host_choice"
Use an object like {"reply_mode":"normal_reply","leave_join_info":"enable","add_remove_info":"enable","meeting_chat_type":"channel"} as a safe baseline for most channels. "Blank/empty" means the entire Config JSON field is omitted, an empty string, or an empty object {}. Do not set individual keys to "" or null; omit those keys entirely.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('config_json', 'Recommended raw JSON config object for channel create. Allowed keys: reply_mode ("normal_reply" | "threads" | "both"), leave_join_info ("enable" | "disable"), add_remove_info ("enable" | "disable"), meeting_chat_type ("channel" | "thread" | "host_choice"). Omit any key you do not want to send. Do not set keys to empty strings or null.', 'string', {}) }}
```

---

### Additional Fields > Description (Optional)

- Plain text description:
```txt
Optional channel description. Blank values are allowed and treated as omitted. Max length 10500.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('description', 'Optional channel description. Blank values are allowed and treated as omitted. Max 10500 characters.', 'string', '') }}
```

---

### Additional Fields > Image Data (Base64) (Optional)

- Plain text description:
```txt
Optional channel image payload as inline base64 content. Do not provide a normal image URL. A data URL is acceptable only if it contains base64 image data inline. Prefer raw base64 when the agent can provide it. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('image_data', 'Optional channel image payload as inline base64 content. Do not provide a normal image URL. A data URL is acceptable only when it contains base64 image data inline. Prefer raw base64. Leave blank to omit.', 'string', '') }}
```

---

### Additional Fields > Invite Only (Optional)

- Plain text description:
```txt
Optional invite-only flag. OpenAPI default is false. Supported only for organization and team channels. If true is used for private (invite_only by default) or external channels, the node rejects the request instead of sending a no-op value.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('invite_only', 'Optional boolean. OpenAPI default is false. Supported only for organization and team channels. If true is used for private (invite_only by default) or external channels, the node rejects the request.', 'boolean', false) }}
```

---

### Additional Fields > Team IDs (Optional)

- Plain text description:
```txt
Comma-separated team IDs. Required when channel_level is "team". For non-team channel levels, leave blank and the node omits this field.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('team_ids', 'Comma-separated team IDs. Required when channel_level is "team". Leave blank only for non-team channel levels.', 'string', '') }}
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
