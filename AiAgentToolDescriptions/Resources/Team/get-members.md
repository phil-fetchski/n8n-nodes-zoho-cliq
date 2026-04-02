# Team: Get Team Members

Use this guide to configure **Get Team Members** for AI Agent Tool mode in n8n.

This operation retrieves the members of one existing team in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- For **Team** plain-text Sparkles setup, switch the locator from `From List` to `By ID` before delegating the value.
- For **Team** `$fromAI()` setup, set the field to expression mode before pasting the expression.

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
Get the members of one team in Zoho Cliq using an exact `team_id`. Successful responses return a `members` array. Each member entry commonly includes `user_id`, `display_name`, and `is_moderator`. Reuse `members[].user_id` for follow-up membership changes, and reuse `team_id` from the calling context for later team operations.

Example response:
{
  "members": [
    {
      "email_id": "scott.fischer@zylker.com",
      "user_id": "53773501",
      "display_name": "Scott",
      "is_moderator": false,
      "user_type": 0,
      "role": "member",
      "full_name": "Scott Fisher"
    },
    {
      "email_id": "quinn.rivers@zylker.com",
      "user_id": "53997102",
      "display_name": "Quinn",
      "is_moderator": true,
      "user_type": 0,
      "role": "moderator",
      "full_name": "Quinn Rivers"
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

### Team (Required)

- Plain text description:
```txt
Required canonical team ID in Zoho Cliq for the team whose members should be retrieved. Use the exact `team_id`. For example: `897444555`. Do not pass a team name here.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('team_id', 'Required canonical team ID in Zoho Cliq for the team whose members should be retrieved. Use the exact `team_id`. For example: `897444555`. Do not pass a team name here.', 'string') }}
```
