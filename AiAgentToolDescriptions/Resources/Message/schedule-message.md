# Message: Schedule Message

Use this guide to configure **Schedule Message** for AI Tool mode in n8n.

This operation schedules one future or status-triggered message in Zoho Cliq for one chat conversation.

It supports two AI-controlled payload paths: `text` for normal plain-text messages, or `json` for raw JSON message objects used mainly for card payloads.

- Set **Schedule Field Visibility** to `Agent Setup` so both time-based and status-based schedule inputs stay visible when **Schedule Mode** is expression-driven. **Schedule Field Visibility** is manual-only and must not be delegated to the agent.
## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- The **Simplify** toggle is ON by default, returning simplified output. Turn it OFF for the full raw API response. When ON, use the **Simplify Mode** selector to choose between Simplified, Raw, or Selected Fields — see the **Simplify Output** section below for mode details, Tool Description selection instructions, and guidance on editing the Selected Fields template.
- Do not delegate **Schedule Field Visibility** to the agent.
- Decide upfront whether **Message Type** will be fixed by the user or chosen by the agent.
- If the user fixes **Message Type** to `text`, make **Text** the only agent-controlled content input and leave **JSON** blank.
- If the user fixes **Message Type** to `json`, make **JSON** the only agent-controlled content input and leave **Text** blank.
- If **Message Type** is AI-controlled with `$fromAI()`, configure both **Text** and **JSON** with the optional expression variants from this guide so the agent can populate only the field that matches the selected message type.
- Do not use `rich` / `Rich/Card` for AI Tool setup in this operation.

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
Schedule one message to be posted in the future using `Chat ID` plus one scheduling path:
- `time` requires `Schedule Time` and optionally `Schedule Timezone`
- `status` requires `Schedule Status` and works only with DM/Private Conversations, bases posting on a change in the recipients status.

Status-based scheduling requires a direct-message `Chat ID`. Channel and thread chat IDs are not supported for that mode. Schedule Mode `status` only works with DM Conversations/Private Messages, this Mode will fail for Group Chats or Channels.

Use `Schedule Time` in `yyyyMMddTHHmmss` format (ISO 8601 basic), for example `20270109T143000`.

Provide `Message Type` as either `text` or `json`:
- `text` uses the `Text` field for a normal plain-text message
- `json` uses the `JSON` field and must include a non-empty top-level `text` string
- use `json` mainly for card payloads such as `text` + `card` / `slides` / `buttons`
- if a structured Zoho Cliq card payload is needed and the tool is available, first call `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and then pass its returned object into this tool's `json_payload` field

If `Post as Bot` is true, provide `Bot Unique Name`. `Post as Bot` is supported only for time-based scheduled messages.

Please Note that the `text` input for Schedule a Message is limited to 4096 characters, considerably less than the 5000 character limit for Post a Message or Edit a Message Tools. This is an API limitation unique to the Schedule a Message Endpoint. Always consider this constraint when swapping between the Message Sending Tools.

Please Note that Scheduling a Message in Zoho Cliq requires the Conversation's Chat ID. Every type of Conversation in Zoho Cliq has a unique Chat ID, including Channels, but Chat ID is NOT a Channel ID and additional steps may be necessary to obtain a Channel's Chat ID in order to use this Tool.

Successful responses return a flat object with the most useful fields. The nested `message` object (with ctype, mtype, chid, meta, temp_info) is dropped and its `msg` value is flattened to `message_text`.

Example response:
{
  "id": "SM_1740000000123_15067887",
  "time": "20270109T143000",
  "time_string": "Jan 09, 2027 02:30 PM",
  "creator": "15067887",
  "created_time": "1740000000123",
  "timezone": "America/New_York",
  "message_text": "Reminder: team standup in 30 minutes."
}

Chaining guidance:
- use `id` when a later tool needs the scheduled message ID
- use `time_string` to confirm the scheduled delivery time to the user
```

### Simplify = Selected Fields

```txt
Schedule one message to be posted in the future using `Chat ID` plus one scheduling path:
- `time` requires `Schedule Time` and optionally `Schedule Timezone`
- `status` requires `Schedule Status` and works only with DM/Private Conversations, bases posting on a change in the recipients status.

Status-based scheduling requires a direct-message `Chat ID`. Channel and thread chat IDs are not supported for that mode. Schedule Mode `status` only works with DM Conversations/Private Messages, this Mode will fail for Group Chats or Channels.

Use `Schedule Time` in `yyyyMMddTHHmmss` format (ISO 8601 basic), for example `20270109T143000`.

Provide `Message Type` as either `text` or `json`:
- `text` uses the `Text` field for a normal plain-text message
- `json` uses the `JSON` field and must include a non-empty top-level `text` string
- use `json` mainly for card payloads such as `text` + `card` / `slides` / `buttons`
- if a structured Zoho Cliq card payload is needed and the tool is available, first call `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and then pass its returned object into this tool's `json_payload` field

If `Post as Bot` is true, provide `Bot Unique Name`. `Post as Bot` is supported only for time-based scheduled messages.

Please Note that the `text` input for Schedule a Message is limited to 4096 characters, considerably less than the 5000 character limit for Post a Message or Edit a Message Tools. This is an API limitation unique to the Schedule a Message Endpoint. Always consider this constraint when swapping between the Message Sending Tools.

Please Note that Scheduling a Message in Zoho Cliq requires the Conversation's Chat ID. Every type of Conversation in Zoho Cliq has a unique Chat ID, including Channels, but Chat ID is NOT a Channel ID and additional steps may be necessary to obtain a Channel's Chat ID in order to use this Tool.

Successful responses return only the configured Output Fields. `id` is always included.

Example response:
{
  "id": "SM_1740000000123_15067887",
  "time_string": "Jan 09, 2027 02:30 PM"
}

Chaining guidance:
- use `id` when a later tool needs the scheduled message ID
```

### Simplify = Raw

```txt
Schedule one message to be posted in the future using `Chat ID` plus one scheduling path:
- `time` requires `Schedule Time` and optionally `Schedule Timezone`
- `status` requires `Schedule Status` and works only with DM/Private Conversations, bases posting on a change in the recipients status.

Status-based scheduling requires a direct-message `Chat ID`. Channel and thread chat IDs are not supported for that mode. Schedule Mode `status` only works with DM Conversations/Private Messages, this Mode will fail for Group Chats or Channels.

Use `Schedule Time` in `yyyyMMddTHHmmss` format (ISO 8601 basic), for example `20270109T143000`.

Provide `Message Type` as either `text` or `json`:
- `text` uses the `Text` field for a normal plain-text message
- `json` uses the `JSON` field and must include a non-empty top-level `text` string
- use `json` mainly for card payloads such as `text` + `card` / `slides` / `buttons`
- if a structured Zoho Cliq card payload is needed and the tool is available, first call `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and then pass its returned object into this tool's `json_payload` field

If `Post as Bot` is true, provide `Bot Unique Name`. `Post as Bot` is supported only for time-based scheduled messages.

Please Note that the `text` input for Schedule a Message is limited to 4096 characters, considerably less than the 5000 character limit for Post a Message or Edit a Message Tools. This is an API limitation unique to the Schedule a Message Endpoint. Always consider this constraint when swapping between the Message Sending Tools.

Please Note that Scheduling a Message in Zoho Cliq requires the Conversation's Chat ID. Every type of Conversation in Zoho Cliq has a unique Chat ID, including Channels, but Chat ID is NOT a Channel ID and additional steps may be necessary to obtain a Channel's Chat ID in order to use this Tool.

Returns the full API response with the nested `message` object.

Example response:
{
  "id": "SM_1740000000123_15067887",
  "time": "20270109T143000",
  "time_string": "Jan 09, 2027 02:30 PM",
  "creator": "15067887",
  "created_time": "1740000000123",
  "timezone": "America/New_York",
  "message": {
    "msg": "Reminder: team standup in 30 minutes.",
    "ctype": "text",
    "mtype": "text",
    "chid": "C_1234567890",
    "meta": {},
    "temp_info": {}
  }
}

Chaining guidance:
- use `id` when a later tool needs the scheduled message ID
- use `time_string` to confirm the scheduled delivery time to the user
- use `message.msg` to access the scheduled message text
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Schedule Mode (Required)

- Plain text description:
```txt
Required scheduling mode. ENUM: ["time", "status"]. Use `time` for a future timestamp or `status` for a user-status trigger.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('schedule_mode', 'Required scheduling mode. ENUM: [\"time\", \"status\"]. Use `time` for a future timestamp or `status` for a user-status trigger.', 'string') }}
```

---

### Schedule Time (Optional)

- Plain text description:
```txt
Use this only when Schedule Mode is `time`. This field is required when Schedule Mode is `time`. Provide one `yyyyMMddTHHmmss` value (ISO 8601 basic), for example `20270109T143000`. Leave blank only when Schedule Mode is `status`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('schedule_time', 'Use this only when Schedule Mode is `time`. This field is required when Schedule Mode is `time`. Provide one `yyyyMMddTHHmmss` value (ISO 8601 basic), for example `20270109T143000`. Leave blank only when Schedule Mode is `status`.', 'string', '') }}
```

---

### Schedule Timezone (Optional)

- Plain text description:
```txt
Use this only when Schedule Mode is `time`. Provide the canonical IANA timezone that should govern the scheduled send time, such as America/New_York, Europe/London, or Asia/Kolkata. Avoid abbreviations like EST or PST.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('schedule_timezone', 'Use this only when Schedule Mode is `time`. Provide the canonical IANA timezone that should govern the scheduled send time, such as America/New_York, Europe/London, or Asia/Kolkata. Avoid abbreviations like EST or PST.', 'string', '') }}
```

---

### Schedule Status (Optional)

- Plain text description:
```txt
Use this only when Schedule Mode is `status`. Default `user_available`. Schedule Mode `status` only works with DM Conversations/Private Messages, this Mode will fail for Group Chats or Channels. Set a different value only when needed. ENUM: ["check_in", "user_available", "call_end", "check_out"].
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('schedule_status', 'Use this only when Schedule Mode is `status`. Default `user_available`. Schedule Mode `status` only works with DM Conversations/Private Messages, this Mode will fail for Group Chats or Channels. Set a different value only when needed. ENUM: [\"check_in\", \"user_available\", \"call_end\", \"check_out\"].', 'string', 'user_available') }}
```

---

### Chat ID (Required)

- Plain text description:
```txt
Required Zoho Cliq chat ID where the scheduled message should be delivered. This is not a channel ID or thread ID. When Schedule Mode is `status`, this must be a direct-message chat_id.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('chat_id', 'Required Zoho Cliq chat ID where the scheduled message should be delivered. This is not a channel ID or thread ID. When Schedule Mode is `status`, this must be a direct-message chat_id.', 'string') }}
```

---

### Message Type (Optional)

- Plain text description:
```txt
Optional message mode. ENUM: ["text", "json"]. Default `text`. Use `text` for normal plain-text messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('message_type', 'Optional message mode. ENUM: [\"text\", \"json\"]. Default `text`. Use `text` for normal plain-text messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.', 'string', 'text') }}
```

---

### Text (Required)

- Plain text description:
```txt
Required when Message Type is `text`. Provide a non-empty string up to 4096 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type is `json`.
```
- Suggested `$fromAI()` when the user manually fixes Message Type to `text`:
```txt
{{ $fromAI('text', 'Required when Message Type is `text`. Provide a non-empty string up to 4096 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type is `json`.', 'string') }}
```
- Suggested `$fromAI()` when Message Type is AI-controlled:
```txt
{{ $fromAI('text', 'Required when Message Type is `text`. Populate this field only when Message Type resolves to `text`. Provide a non-empty string up to 4096 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type resolves to `json`.', 'string', '') }}
```

---

### JSON (Optional)

- Plain text description:
```txt
Required when Message Type is `json`. Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ "text": "...", "card": {...}, "slides": [...], "buttons": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool's `json_payload` field. Leave blank when Message Type is `text`.
```
- Suggested `$fromAI()` when the user manually fixes Message Type to `json`:
```txt
{{ $fromAI('json_payload', 'Required when Message Type is `json`. Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ \"text\": \"...\", \"card\": {...}, \"slides\": [...], \"buttons\": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool\'s `json_payload` field. Leave blank when Message Type is `text`.', 'string') }}
```
- Suggested `$fromAI()` when Message Type is AI-controlled:
```txt
{{ $fromAI('json_payload', 'Required when Message Type is `json`. Populate this field only when Message Type resolves to `json`. Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ \"text\": \"...\", \"card\": {...}, \"slides\": [...], \"buttons\": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool\'s `json_payload` field. Leave blank when Message Type resolves to `text`.', 'string', {}) }}
```

---

### Post as Bot (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when Schedule Mode is `time` and the scheduled message should appear from a bot sender identity. Leave false for status-based scheduling.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('post_as_bot', 'Optional boolean. Set true only when Schedule Mode is `time` and the scheduled message should appear from a bot sender identity. Leave false for status-based scheduling.', 'boolean', false) }}
```

---

### Bot Unique Name (Optional)

- Plain text description:
```txt
Provide the exact bot unique name when Post as Bot is true for a time-based scheduled message. Use letters and numbers only. Leave blank otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_unique_name', 'Provide the exact bot unique name when Post as Bot is true for a time-based scheduled message. Use letters and numbers only. Leave blank otherwise. Example bot unique name: helpdeskbot', 'string', '') }}
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
Fields to include in the output when Simplify Mode is set to Selected Fields. The record ID is always included. Available fields: id, time, time_string, creator, created_time, timezone, message.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: id, time, time_string, creator, created_time, timezone, message. Return a JSON array of field names (e.g. ["id","time_string"]) or a comma-separated string (e.g. "id,time_string"). Both formats are accepted.', 'string', '["id"]') }}
```
