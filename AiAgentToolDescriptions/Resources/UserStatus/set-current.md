# User Status: Update Current Status

Use this guide to configure **Update Current Status** for AI Agent Tool mode in n8n.

This operation switches the authenticated user to one existing reusable status in Zoho Cliq.

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
Set one existing reusable status as the authenticated user's current status in Zoho Cliq using `status_id`. Use a `status_id` returned by `Retrieve_all_statuses_in_Zoho_Cliq`. This operation replaces the authenticated user's currently active status with the selected saved status and does not switch status for another user. Successful responses return `url`, `type`, and a `data` object with the applied status details. Reuse `data.code` and `data.message` to confirm the active status or compare them with the active status returned by `Retrieve_current_status_in_Zoho_Cliq`.

Example response:
{
  "url": "/api/v2/statuses/1775998000034476000/set",
  "type": "status_message",
  "data": {
    "code": "available",
    "message": "Coffee break",
    "id": "1775998000034476000"
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

### Status (Required)

- Plain text description:
```txt
Required reusable status ID to activate for the authenticated user in Zoho Cliq. Use the exact `data[].id` returned by `Retrieve_all_statuses_in_Zoho_Cliq`. This replaces the user's currently active status. Do not pass a status message here.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('status_id', 'Required reusable status ID to activate for the authenticated user in Zoho Cliq. Use the exact `data[].id` returned by `Retrieve_all_statuses_in_Zoho_Cliq`. This replaces the user\'s currently active status. Do not pass a status message here.', 'string') }}
```
