# Reminders: Assign Users

Use this guide to configure **Assign Users** for AI Agent Tool mode in n8n.

This operation assigns up to 4 users to one existing reminder in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- For **Reminder ID** plain-text Sparkles setup, switch the locator from `From List` to `By ID` before delegating the value.
- For **Reminder ID** `$fromAI()` setup, set the field to expression mode before pasting the expression.

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
Assign up to 4 exact user IDs to one existing reminder in Zoho Cliq using an exact `reminder_id`. Treat this as an additive assignee action: it adds/appends the specified users to the reminder rather than replacing the full assignee list. Zoho Cliq reminder categories are bucket labels: use `mine` for the authenticated user's active reminders, `mine-completed` for their completed reminders, `others` for active reminders they created for other users or chats/channels, and `others-completed` for those created-for-others reminders after completion. Use this only for users-type reminders in the `others` category. Chat-targeted reminders do not support user assignment. Do not try to assign the reminder creator or authenticated user back onto their own reminder. Successful responses return the updated reminder object, typically including `id`, `content`, `completed`, `creation_time`, and `users[]` entries with assignee `id`, `name`, `completed`, and `deleted` flags. Good chaining pattern: list `category=others` -> choose a users-type reminder `list[].id` -> assign users -> reuse the returned `id` or `users[].id` in later remind or remove-assignee steps.

Example response:
{
  "id": "11360000000205013",
  "content": "Functionality Design Review Meeting",
  "completed": false,
  "creation_time": 1506398400000,
  "users": [
    {
      "id": "7234192",
      "name": "Scott Fisher",
      "completed": false,
      "deleted": false
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

### Reminder ID (Required)

- Plain text description:
```txt
Required exact Zoho Cliq `reminder_id` to update with new assignees. `reminder_id` alone identifies the reminder here; do not pass a category parameter. Use a reminder ID from the active `others` reminder bucket that targets users, not a chat-targeted reminder and not a reminder from `mine` or completed categories.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('reminder_id', 'Required exact Zoho Cliq `reminder_id` to update with new assignees. `reminder_id` alone identifies the reminder here; do not pass a category parameter. Use a reminder ID from the active `others` reminder bucket that targets users, not a chat-targeted reminder and not a reminder from `mine` or completed categories.', 'string') }}
```

---

### User IDs (Required)

- Plain text description:
```txt
Required comma-separated list of 1 to 4 exact Zoho Cliq assignee user IDs to add to this reminder. This adds/appends these users; it does not replace the full assignee list. Use numeric user IDs only, typically 9 digits, for example `723419201,249871345`. Do not pass names, emails, or free-form text here. Do not include the reminder creator or authenticated user as an assignee on their own Others reminder.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('user_ids', 'Required comma-separated list of 1 to 4 exact Zoho Cliq assignee user IDs to add to this reminder. This adds/appends these users; it does not replace the full assignee list. Use numeric user IDs only, typically 9 digits, for example `723419201,249871345`. Do not pass names, emails, or free-form text here. Do not include the reminder creator or authenticated user as an assignee on their own Others reminder.', 'string') }}
```
