# Chat: Pin Message

Use this guide to configure **Pin Message** for AI Agent Tool mode in n8n.

This operation pins one existing Zoho Cliq chat message as the current pinned message for that chat.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.

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
Pin one existing chat message as the pinned message in Zoho Cliq using chat_id and message_id. Returns success metadata including success, operation, chat_id, message_id, notify, expiry_time, and the native Zoho Cliq pinned message payload in data. If a pinned message is already set, Zoho Cliq replaces it with the newly pinned message.

For example:
{
  success: true,
  operation: "pinStickyMessage",
  chat_id: "CT_2243173626687865223_P87610291-C4",
  message_id: "1573708648341_375412769224",
  notify: false,
  expiry_time: -1,
  data: {
    expiry_time: -1,
    creator: {
      name: "Scott Fisher",
      id: "690440148"
    },
    message: {
      msg: "meeting at 4",
      msguid: "1573708648341_375412769224"
    },
    chat_id: "CT_2243173626687865223_P87610291-C4"
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

### Chat ID (Required)

- Plain text description:
```txt
Required Zoho Cliq chat ID for the conversation where the message should be pinned. This is not a channel_id. Chat IDs are not limited to one format: some are all-numeric and some use a CT_ style. Do not pass a channel ID, channel unique name, or display name.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('chat_id', 'Required Zoho Cliq chat ID for the conversation where the message should be pinned. This is not a channel_id. Chat IDs are not limited to one format: some are all-numeric and some use a CT_ style. Do not pass a channel ID, channel unique name, or display name.', 'string') }}
```

---

### Message ID (Required)

- Plain text description:
```txt
Required Zoho Cliq message ID (msguid) of the existing message to pin. Use the exact message ID returned by Zoho Cliq for a message in that chat. Encoded message IDs such as 1573708648341%20375412769224 are allowed.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('message_id', 'Required Zoho Cliq message ID (msguid) of the existing message to pin. Use the exact message ID returned by Zoho Cliq for a message in that chat. Encoded message IDs such as 1573708648341%20375412769224 are allowed.', 'string') }}
```

---

### Pin Options > Notify (Optional)

- Plain text description:
```txt
Optional boolean. Set true when Zoho Cliq should notify chat participants about the newly pinned message. Leave false to pin silently.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('notify', 'Optional boolean. Set true when Zoho Cliq should notify chat participants about the newly pinned message. Leave false to pin silently.', 'boolean', false) }}
```

---

### Pin Options > Expire At (Optional)

- Plain text description:
```txt
Optional future expiry for when the pinned message should expire. You may provide either an ISO 8601 date-time string or a future epoch-millisecond value such as 1735689600000. If using ISO 8601, prefer a timezone offset or Z/UTC to avoid ambiguity, but this node also accepts a plain date such as 2027-12-31 and interprets it as midnight UTC. Blank values are allowed and treated as omitted, which creates a pinned message with no expiry. The node converts this to the Zoho Cliq expiry_time format and will retry with an absolute epoch-millisecond value if Zoho rejects the first expiry format.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('expire_at', 'Optional future expiry for when the pinned message should expire. Provide either an ISO 8601 date-time string or a future epoch-millisecond value such as 1735689600000. If using ISO 8601, prefer a timezone offset or Z/UTC to avoid ambiguity, but this node also accepts a plain date such as 2027-12-31 and interprets it as midnight UTC. Blank values are allowed and treated as omitted, which creates a pinned message with no expiry.', 'string', '') }}
```

---
