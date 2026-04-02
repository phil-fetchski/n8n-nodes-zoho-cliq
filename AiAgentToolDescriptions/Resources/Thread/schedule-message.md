# Thread: Schedule Message

Use this guide to configure **Schedule Message** for AI Tool mode in n8n when the tool is used from the **Thread** resource.

This operation schedules one future message in Zoho Cliq for one existing thread conversation.

It supports two AI-controlled payload paths: `text` for normal plain-text messages, or `json` for raw JSON message objects used mainly for card payloads.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- This Thread-specific tool always uses one unified time-based scheduling UI. **Schedule Field Visibility**, **Schedule Mode**, and **Schedule Status** should not be exposed for the Thread tool.
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

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Schedule one future message in Zoho Cliq for one existing thread conversation using `Thread Chat ID`.

This Thread tool is for thread conversations only. `Thread Chat ID` must be the thread conversation ID returned by thread-aware tools such as List Threads for Channel or Get Main Message. Do not pass a channel ID, channel unique name, parent chat ID, or general non-thread conversation ID here.

Use `Schedule Time` in `yyyyMMddTHHmmss` format (ISO 8601 basic), for example `20270109T143000`. Optionally provide `Schedule Timezone` with a canonical IANA timezone such as `America/New_York`.

Provide `Message Type` as either `text` or `json`:
- `text` uses the `Text` field for a normal plain-text message
- `json` uses the `JSON` field and must include a non-empty top-level `text` string
- use `json` mainly for card payloads such as `text` + `card` / `slides` / `buttons`
- if a structured Zoho Cliq card payload is needed and the tool is available, first call `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and then pass its returned object into this tool's `json_payload` field

If `Post as Bot` is true, provide `Bot Unique Name`. `Post as Bot` is supported only for time-based scheduled messages.

The `text` input for Schedule Message is limited to 4096 characters, which is lower than the 5000 character limit used by Post to Thread.

Successful responses return the Zoho Cliq scheduled-message response for the thread schedule request. Reuse returned scheduling metadata or identifiers from that response in later workflow steps when available.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Schedule Time (Required)

- Plain text description:
```txt
Required scheduled send time for the thread message. Provide one `yyyyMMddTHHmmss` value (ISO 8601 basic), for example `20270109T143000`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('schedule_time', 'Required scheduled send time for the thread message. Provide one `yyyyMMddTHHmmss` value (ISO 8601 basic), for example `20270109T143000`.', 'string') }}
```

---

### Schedule Timezone (Optional)

- Plain text description:
```txt
Optional canonical IANA timezone that should govern the scheduled send time, such as America/New_York, Europe/London, or Asia/Kolkata. Avoid abbreviations like EST or PST.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('schedule_timezone', 'Optional canonical IANA timezone that should govern the scheduled send time, such as America/New_York, Europe/London, or Asia/Kolkata. Avoid abbreviations like EST or PST.', 'string', '') }}
```

---

### Thread Chat ID (Required)

- Plain text description:
```txt
Required Zoho Cliq thread chat ID where the scheduled message should be delivered. This must be the thread conversation ID itself, not a channel ID, channel unique name, parent chat ID, or normal non-thread chat ID.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('thread_chat_id', 'Required Zoho Cliq thread chat ID where the scheduled message should be delivered. This must be the thread conversation ID itself, not a channel ID, channel unique name, parent chat ID, or normal non-thread chat ID.', 'string') }}
```

---

### Message Type (Optional)

- Plain text description:
```txt
Optional message mode. ENUM: ["text", "json"]. Default `text`. Use `text` for normal plain-text thread messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('message_type', 'Optional message mode. ENUM: [\"text\", \"json\"]. Default `text`. Use `text` for normal plain-text thread messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.', 'string', 'text') }}
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
Optional boolean. Set true only when the scheduled thread message should appear from a bot sender identity. Leave false otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('post_as_bot', 'Optional boolean. Set true only when the scheduled thread message should appear from a bot sender identity. Leave false otherwise.', 'boolean', false) }}
```

---

### Bot Unique Name (Optional)

- Plain text description:
```txt
Provide the exact bot unique name when Post as Bot is true for a time-based scheduled thread message. Use letters and numbers only. Leave blank otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_unique_name', 'Provide the exact bot unique name when Post as Bot is true for a time-based scheduled thread message. Use letters and numbers only. Leave blank otherwise. Example bot unique name: helpdeskbot', 'string', '') }}
```
