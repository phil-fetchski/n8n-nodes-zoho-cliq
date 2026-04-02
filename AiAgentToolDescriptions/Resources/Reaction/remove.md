# Reaction: Remove Reaction

Use this guide to configure **Remove Reaction** for AI Tool mode in n8n.

This operation removes one specific emoji reaction from one existing Zoho Cliq message.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- Set **Emoji Input Mode** to `Custom (Shortcode or Unicode)` so the agent can send either a Unicode emoji or a Cliq shortcode through **Emoji Code**.
- Do not delegate **Emoji Input Mode** to the agent.

This operation requires both OAuth scopes `ZohoCliq.messageactions.CREATE` and `ZohoCliq.messageactions.DELETE`.

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
Remove one emoji reaction in Zoho Cliq from one existing message using `chat_id`, `message_id`, and `emoji_code`. Use the exact chat/message identifiers for the existing message. For `emoji_code`, send either a real Unicode emoji such as 👍 or a known Zoho Cliq shortcode such as `:smile:`. If you are removing a reaction after Get Reactions, reuse the exact reaction identifier returned in `data`, which may be either format. Important: this operation removes only the connected account's own reaction entry for the selected `emoji_code`. If Get Reactions shows that `emoji_code` only under another user's entry, this remove call can still return `success: true` while leaving the reaction unchanged on the message. Do not treat `success: true` as confirmation that the reaction was removed. When confirmation matters, run Get Reactions again and compare the entries under that same `emoji_code`.

Returns workflow-friendly success metadata including `success`, `resource`, `operation`, `chat_id`, `message_id`, and `emoji_code`. The raw Zoho Cliq body may also include `data`, and successful responses can legitimately return `data` as an empty string.
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
Required Zoho Cliq chat ID for the conversation that contains the target message. This is not a channel ID or thread ID. Use the exact chat_id only.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('chat_id', 'Required Zoho Cliq chat ID for the conversation that contains the target message. This is not a channel ID or thread ID. Use the exact chat_id only.', 'string') }}
```

---

### Message ID (Required)

- Plain text description:
```txt
Required Zoho Cliq message ID to remove the reaction from inside the selected chat. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('message_id', 'Required Zoho Cliq message ID to remove the reaction from inside the selected chat. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message.', 'string') }}
```

---

### Emoji Code (Required)

- Plain text description:
```txt
Required emoji to remove from the message reactions. Send either a real Unicode emoji such as 👍 or a known Zoho Cliq shortcode such as `:smile:`. If this value comes from Get Reactions, reuse the exact reaction identifier returned in `data`. Important: this removes only the connected account's own reaction entry for that `emoji_code`. If the returned entries for that `emoji_code` belong only to another user, this call can still return `success: true` with no actual change. Do not leave blank.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('emoji_code', 'Required emoji to remove from the message reactions. Send either a real Unicode emoji such as 👍 or a known Zoho Cliq shortcode such as `:smile:`. If this value comes from Get Reactions, reuse the exact reaction identifier returned in `data`. Important: this removes only the connected account\'s own reaction entry for that `emoji_code`. If the returned entries for that `emoji_code` belong only to another user, this call can still return `success: true` with no actual change. Do not leave blank.', 'string') }}
```
