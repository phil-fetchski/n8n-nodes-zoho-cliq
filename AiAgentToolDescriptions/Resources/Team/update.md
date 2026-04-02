# Team: Update Team

Use this guide to configure **Update Team** for AI Agent Tool mode in n8n.

This operation updates one team in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Set **Input Mode** to `Using Fields Below`.
- Use the structured `Name` and `Description` fields for agent-controlled input.
- Do not delegate **Input Mode** to the agent.

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
Update one team in Zoho Cliq using a canonical `team_id`. You must provide at least one of `name` or `description`; calling this tool with neither is an error. `name` must be a non-empty string up to 30 characters when provided. `description` is optional and omitted when blank. Successful responses return the updated team object, which commonly includes `team_id`, `name`, `description`, `participant_count`, `joined`, `organization_id`, `creation_time`, and `is_active`. Use `team_id` for chaining into Get Team, Add Team Members, Delete Team Members, Get Team Members, or Delete Team.

Example response:
{
  "name": "Engineering",
  "creation_time": "2017-11-08T15:18:49+05:30",
  "organization_id": "53787097",
  "is_active": true,
  "is_moderator": true,
  "description": "Updated team description",
  "team_id": "54342319",
  "joined": true,
  "participant_count": 2
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
Required canonical team ID in Zoho Cliq. Use the exact `team_id` for the team you want to update. For example: `897444555`. Do not pass a team name here.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('team_id', 'Required canonical team ID in Zoho Cliq. Use the exact `team_id` for the team you want to update. For example: `897444555`. Do not pass a team name here.', 'string') }}
```

---

### Name (Optional)

- Plain text description:
```txt
Optional updated team name in Zoho Cliq. Leave blank to omit it. When provided, use a non-empty string up to 30 characters.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('name', 'Optional updated team name in Zoho Cliq. Leave blank to omit it. When provided, use a non-empty string up to 30 characters.', 'string', '') }}
```

---

### Description (Optional)

- Plain text description:
```txt
Optional updated team description in Zoho Cliq. Leave blank to omit it. When provided, use plain text up to 1000 characters. At least one of `name` or `description` must remain after blank values are omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('description', 'Optional updated team description in Zoho Cliq. Leave blank to omit it. When provided, use plain text up to 1000 characters. At least one of `name` or `description` must remain after blank values are omitted.', 'string', '') }}
```
