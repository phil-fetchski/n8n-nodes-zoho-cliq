# Reminders: List Reminders

Use this guide to configure **List Reminders** for AI Agent Tool mode in n8n.

This operation lists reminders in Zoho Cliq with optional category and pagination inputs.

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
List reminders in Zoho Cliq using optional `category`, `limit`, and `next_set_token` inputs. Zoho Cliq reminder categories are bucket labels: use `mine` for the authenticated user's active reminders, `mine-completed` for their completed reminders, `others` for active reminders they created for other users or chats/channels, and `others-completed` for those created-for-others reminders after completion. When `category` is omitted, Zoho Cliq defaults to `mine`. Successful responses usually include `category`, `list`, and sometimes `next_set_token` for pagination. Live responses can also include `has_more: true` when another page is available and a top-level `time` server timestamp. Each reminder in `list[]` can include reusable fields such as `id`, `content`, `completed`, `time`, `creation_time`, `users[]`, and, for message-linked reminders, `message.message_id` plus `message.chat_id`. Reuse `list[].id` as `reminder_id`. For pagination, treat `has_more` plus `next_set_token` as the continue signal. Good chaining patterns: use `category=mine` before `markComplete` or `snooze`, use `category=mine-completed` before `markIncomplete` or `clearCompleted`, and inspect `list[].completed`, `list[].users`, `list[].chats`, or `list[].message` before choosing a follow-up action.

Example response:
{
  "category": "mine",
  "has_more": true,
  "time": 1762393700000,
  "list": [
    {
      "creation_time": 1506398400000,
      "content": "Appathon submissions review",
      "completed": false,
      "timezone": "America/New_York",
      "time": 1506571200000,
      "users": [
        {
          "deleted": false,
          "snoozed_time": 1506398650000,
          "name": "John Doe",
          "completed": false,
          "id": "987654321"
        }
      ],
      "message": {
        "message_id": 1536853438313,
        "chat_id": "CT_1277744254305568677_53600857"
      },
      "id": "5452022000005551111"
    }
  ],
  "next_set_token": "<NEXT_SET_PAGINATION_TOKEN_HERE>"
}
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Additional Fields > Category (Optional)

- Plain text description:
```txt
Optional reminder category filter. ENUM: ["mine", "mine-completed", "others", "others-completed"]. `mine` means active reminders for the authenticated user. `mine-completed` means completed reminders in that same personal bucket. `others` means active reminders the authenticated user created for other users or chats/channels. `others-completed` means completed reminders from that others-created bucket. Leave blank to omit. When omitted, Zoho Cliq defaults to `mine`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('category', 'Optional reminder category filter. ENUM: ["mine", "mine-completed", "others", "others-completed"]. `mine` means active reminders for the authenticated user. `mine-completed` means completed reminders in that same personal bucket. `others` means active reminders the authenticated user created for other users or chats/channels. `others-completed` means completed reminders from that others-created bucket. Leave blank to omit. When omitted, Zoho Cliq defaults to `mine`. Blank values are allowed and omitted.', 'string', '') }}
```

---

### Additional Fields > Limit (Optional)

- Plain text description:
```txt
Optional whole-number page size from 1 to 100.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('limit', 'Optional whole-number page size (limit). Use a whole number from 1 to 100.', 'number', 50) }}
```

---

### Additional Fields > Next Set Token (Optional)

- Plain text description:
```txt
Optional. Opaque pagination cursor returned by the previous response as `next_set_token`. Use the exact `next_set_token` returned by the previous page. When the response no longer includes `has_more: true` or `next_set_token`, pagination is complete. If Zoho Cliq rejects the token, restart the listing from the beginning without a token. Leave blank to omit. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('next_set_token', 'Optional. Opaque pagination cursor returned by the previous response as `next_set_token`. Use the exact `next_set_token` returned by the previous page. When the response no longer includes `has_more: true` or `next_set_token`, pagination is complete. If Zoho Cliq rejects the token, restart the listing from the beginning without a token. Leave blank to omit. Blank values are allowed and omitted.', 'string', '') }}
```
