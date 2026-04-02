# Bot: Get Bot Subscribers

Use this guide to configure **Retrieve Bot Subscribers** for AI Agent Tool mode in n8n.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.

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
Retrieve bot subscribers in Zoho Cliq. Use this to fetch users currently subscribed to a bot. Successful responses return subscriber entries plus pagination/sync cursors when available, for example:
{
  "url": "/api/v2/bots/spotthewatchdog/subscribers",
  "type": "list",
  "data": [
    {
      "email_id": "alex@example.com",
      "user_id": "123456789",
      "name": "Alex Rivera"
    }
  ],
  "next_token": "next-page-token",
  "sync_token": "sync-cursor-token"
}
For pagination, continue with next_token until it is no longer returned. For incremental sync, reuse sync_token without next_token to fetch incremental changes; sync responses can include additions, updates, and deleted/unsubscribed entries.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Bot Unique Name (Required by API)

- Plain text description:
```txt
Required. Cliq bot unique name used in the API path. Use lowercase letters only (a-z), with no numbers, spaces, or special characters. Do not use the display name. Example: display name Spot-the-Watchdog uses unique name spotthewatchdog.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_unique_name', 'Required. Cliq bot unique name used in the API path. Use lowercase letters only (a-z), with no numbers, spaces, or special characters. Do not use the display name. Example: display name Spot-the-Watchdog uses bot_unique_name spotthewatchdog.', 'string') }}
```

---

### Additional Fields > App Key (Optional)

- Plain text description:
```txt
Optional. Marketplace extension app key. Provide only when the target bot belongs to a custom extension app. Leave empty for regular bots.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('app_key', 'Optional. Marketplace extension app key. Provide only when the target bot belongs to a custom extension app. Leave empty for regular bots.', 'string', '') }}
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

### Additional Fields > Next Token (Optional)

- Plain text description:
```txt
Optional. Opaque pagination cursor returned as next_token in the previous response. Reuse exactly as returned to fetch the next page of standard pagination results. Do not combine with sync_token.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('next_token', 'Optional. Opaque pagination cursor returned by the previous response as next_token. Reuse exactly as returned to fetch the next page of standard pagination results. Do not combine with sync_token.', 'string', '') }}
```

---

### Additional Fields > Sync Token (Optional)

- Plain text description:
```txt
Optional. Opaque sync cursor returned as sync_token. Use this token alone without next_token to fetch incremental changes since the previous sync point, including additions, updates, and deleted/unsubscribed entries.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('sync_token', 'Optional. Opaque sync cursor returned by the API as sync_token. Use this token alone without next_token to fetch incremental changes since the previous sync point, including additions, updates, and deleted/unsubscribed entries.', 'string', '') }}
```
