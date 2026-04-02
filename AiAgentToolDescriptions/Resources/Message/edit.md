# Message: Edit Message

Use this guide to configure **Edit Message** for AI Tool mode in n8n.

This operation updates one existing message in one Zoho Cliq chat conversation.

It supports two AI-controlled payload paths: `text` for normal plain-text messages, or `json` for raw JSON message objects used mainly for card payloads.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
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
Edit one specific message in Zoho Cliq using `Chat ID`, `Message ID`, and one replacement payload.

Zoho Cliq accounts can enforce age-based edit limits, so older messages may fail even for admins, and messages owned by another sender identity may also be restricted.

Provide `Message Type` as either `text` or `json`:
- `text` uses the `Text` field for a normal plain-text message
- `json` uses the `JSON` field and must include a non-empty top-level `text` string
- use `json` mainly for card payloads such as `text` + `card` / `slides` / `buttons`
- if a structured Zoho Cliq card payload is needed and the tool is available, first call `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and then pass its returned object into this tool's `json_payload` field

Use `Notify Edit` only when Zoho Cliq should also post a separate edit notification.

Please Note that Editing an existing Message in Zoho Cliq requires the Conversation's Chat ID. Every type of Conversation in Zoho Cliq has a unique Chat ID, including Channels, but Chat ID is NOT a Channel ID and additional steps may be necessary to obtain a Channel's Chat ID in order to use this Tool. You can reuse the Post a Message tool's `posted_to_channel.chat_id` output when the target was a Channel.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Chat ID (Required)

- Plain text description:
```txt
Required Zoho Cliq chat ID for the conversation that contains the message to edit. This is not a channel ID or thread ID.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('chat_id', 'Required Zoho Cliq chat ID for the conversation that contains the message to edit. This is not a channel ID or thread ID.', 'string') }}
```

---

### Message ID (Required)

- Plain text description:
```txt
Required Zoho Cliq message ID to edit from the selected chat. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('message_id', 'Required Zoho Cliq message ID to edit from the selected chat. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message.', 'string') }}
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
Required when Message Type is `text`. Provide a non-empty string up to 5000 characters. This field supports limited Zoho Cliq markdown for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type is `json`.
```
- Suggested `$fromAI()` when the user manually fixes Message Type to `text`:
```txt
{{ $fromAI('text', 'Required when Message Type is `text`. Provide a non-empty string up to 5000 characters. This field supports limited Zoho Cliq markdown for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type is `json`.', 'string') }}
```
- Suggested `$fromAI()` when Message Type is AI-controlled:
```txt
{{ $fromAI('text', 'Required when Message Type is `text`. Populate this field only when Message Type resolves to `text`. Provide a non-empty string up to 5000 characters. This field supports limited Zoho Cliq markdown for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type resolves to `json`.', 'string', '') }}
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

### Notify Edit (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when Zoho Cliq should also post an edit notification. False still leaves the normal Edited label on the message.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('notify_edit', 'Optional boolean. Set true only when Zoho Cliq should also post an edit notification. False still leaves the normal Edited label on the message.', 'boolean', false) }}
```
