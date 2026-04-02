# Calls & Meetings: Get Recording Participants & Details

Use this guide to configure **Get Recording Participants & Details** for AI Agent Tool mode in n8n.

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
Get recording participants and details in Zoho Cliq. Use this to retrieve participant details for a media session by media_session_id. When chaining from List Call Recordings, use session_id from the selected recording item (preferred). nrs_id also works if needed. Successful responses return participant details, for example:
{
  "url": "/api/v2/media/sessions/123456789/participants",
  "type": "list",
  "data": [
    {
      "id": "123456789",
      "role": "host",
      "name": "Alex Rivera",
      "email_id": "alex@example.com",
      "start_time": 1741276800000,
      "end_time": 1741278600000
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

### Media Session ID (Required by API)

- Plain text description:
```txt
Required. Media session identifier. Call Recordings === Media Sessions in Cliq API. When chaining from List Call Recordings, use session_id from the selected recording item (preferred). nrs_id also works if needed. Provide the value exactly as returned.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('media_session_id', 'Required. Media session identifier. Call Recordings === Media Sessions in Cliq API. When chaining from List Call Recordings, use session_id from the selected recording item (preferred). nrs_id also works if needed. Provide the value exactly as returned.', 'string') }}
```

---

### Additional Fields > Filter (Optional)

- Plain text description:
```txt
Optional participant state filter. ENUM: ["live", "invited", "joined"].
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('filter', 'Optional participant state filter. ENUM: ["live", "invited", "joined"].', 'string', '') }}
```

---

### Additional Fields > From Time (Optional)

- Plain text description:
```txt
Optional lower-bound Unix timestamp in milliseconds (from) for participant activity.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('from', 'Optional lower-bound Unix timestamp in milliseconds (from) for participant activity.', 'number', 0) }}
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
Optional. Opaque pagination cursor returned as next_token in the previous response. Reuse exactly as returned to fetch the next page of standard pagination results.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('next_token', 'Optional. Opaque pagination cursor returned by the previous response as next_token. Reuse exactly as returned to fetch the next page of standard pagination results.', 'string', '') }}
```

---

### Additional Fields > To Time (Optional)

- Plain text description:
```txt
Optional upper-bound Unix timestamp in milliseconds (to) for participant activity.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('to', 'Optional upper-bound Unix timestamp in milliseconds (to) for participant activity.', 'number', 0) }}
```
